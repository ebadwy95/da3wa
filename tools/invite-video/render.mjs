// Renders tools/invite-video/scene.html into a 9:16 invitation film.
//
//   node tools/invite-video/render.mjs --names "عبدالله و نور" \
//     --date "20 نوفمبر 2026" --venue "قاعة الماسة" --out public/samples/invite.mp4
//
// The scene exposes render(t) and never uses CSS animation, so each frame is
// produced by seeking to an exact time rather than racing wall-clock playback.
// That makes the output deterministic: the same inputs always encode to the
// same film, and a frame can never be captured mid-transition.

import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const FFMPEG_CANDIDATES = [
  "ffmpeg",
  "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
  path.join(process.env.LOCALAPPDATA || "", "Microsoft\\WinGet\\Links\\ffmpeg.exe"),
  // winget installs Gyan's build here and does not always add it to PATH.
  path.join(
    process.env.LOCALAPPDATA || "",
    "Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffmpeg.exe"
  ),
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--")) continue;
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

function findFirst(candidates, label) {
  for (const c of candidates) {
    if (c === "ffmpeg") continue;
    if (c && existsSync(c)) return c;
  }
  if (label === "ffmpeg") return "ffmpeg"; // fall back to PATH
  throw new Error(`Could not find ${label}. Looked in:\n  ${candidates.join("\n  ")}`);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${err.slice(-1500)}`))
    );
  });
}

const args = parseArgs(process.argv);
const names = args.names || "عبدالله و نور";
const date = args.date || "20 نوفمبر 2026";
const venue = args.venue || "";
const outPath = path.resolve(args.out || "public/samples/invite.mp4");
const audioPath = args.audio ? path.resolve(args.audio) : null;

const chrome = findFirst(CHROME_CANDIDATES, "Chrome");
const ffmpeg = findFirst(FFMPEG_CANDIDATES, "ffmpeg");

const frameDir = await mkdtemp(path.join(tmpdir(), "da3wa-frames-"));
await mkdir(path.dirname(outPath), { recursive: true });

console.log(`names : ${names}`);
console.log(`frames: ${frameDir}`);

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
  locale: "ar",
});
const page = await ctx.newPage();
await page.goto(pathToFileURL(path.join(HERE, "scene.html")).href, { waitUntil: "networkidle" });

// Webfonts are the one thing that can still be pending after networkidle, and
// a frame rendered in the fallback face would be visibly wrong.
await page.evaluate(() => document.fonts.ready);
await page.evaluate((c) => window.__scene.setContent(c), { names, date, venue });

const duration = await page.evaluate(() => window.__scene.DURATION);
const total = Math.round(duration * FPS);

for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.__scene.render(t), i / FPS);
  await page.screenshot({
    path: path.join(frameDir, `f${String(i).padStart(4, "0")}.png`),
    animations: "disabled",
  });
  if (i % 30 === 0) process.stdout.write(`  frame ${i}/${total}\r`);
}
console.log(`  frame ${total}/${total}`);
await browser.close();

const ffArgs = [
  "-y",
  "-framerate", String(FPS),
  "-i", path.join(frameDir, "f%04d.png"),
];
if (audioPath) ffArgs.push("-i", audioPath, "-shortest", "-c:a", "aac", "-b:a", "160k");
ffArgs.push(
  "-c:v", "libx264",
  "-preset", "slow",
  "-crf", "20",
  // Phones and WhatsApp are unforgiving about pixel format; yuv420p is the
  // one every decoder accepts.
  "-pix_fmt", "yuv420p",
  // Lets a player start the film before the whole file has arrived.
  "-movflags", "+faststart",
  outPath
);

console.log("encoding...");
await run(ffmpeg, ffArgs);
await rm(frameDir, { recursive: true, force: true });

console.log(`done -> ${outPath}`);
