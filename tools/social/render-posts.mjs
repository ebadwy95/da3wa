// Renders tools/social/posts.json into a week of ready-to-upload files.
//
//   node tools/social/render-posts.mjs
//   node tools/social/render-posts.mjs --only 03-checkin
//   node tools/social/render-posts.mjs --out C:/path/to/folder --audio public/samples/music.mp3
//
// Output lands in social-out/ at the repo root, not public/: these are files
// you upload to Instagram from disk, not assets the site serves, and 5MB of
// them would ride along on every Vercel deploy for nothing.
//
// Square entries become a PNG for the Instagram grid; story entries become a
// 1080x1920 MP4 for Reels and TikTok. Captions and hashtags are written next
// to each file as .txt, because the failure mode that matters here is not a
// bad render — it is the right image posted with the wrong words.
//
// Same approach as tools/invite-video: the scene exposes render(t) and uses no
// CSS animation, so frames are produced by seeking to an exact time and the
// output is reproducible.

import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const FPS = 30;

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const FFMPEG_CANDIDATES = [
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
    if (argv[i]?.startsWith("--")) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

function findChrome() {
  const found = CHROME_CANDIDATES.find((c) => existsSync(c));
  if (!found) throw new Error(`Could not find Chrome. Looked in:\n  ${CHROME_CANDIDATES.join("\n  ")}`);
  return found;
}

const ffmpeg = FFMPEG_CANDIDATES.find((c) => c && existsSync(c)) || "ffmpeg";

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
const outDir = path.resolve(args.out || path.join(ROOT, "social-out"));
const only = args.only || null;
const audio = args.audio ? path.resolve(args.audio) : null;

const { posts } = JSON.parse(await readFile(path.join(HERE, "posts.json"), "utf8"));
const selected = only ? posts.filter((p) => p.id === only) : posts;
if (selected.length === 0) throw new Error(`No post matched --only ${only}`);

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1, locale: "ar" });
const page = await ctx.newPage();
await page.goto(pathToFileURL(path.join(HERE, "card.html")).href, { waitUntil: "networkidle" });
// Webfonts can still be pending after networkidle, and a card rendered in the
// fallback face is visibly wrong rather than subtly wrong.
await page.evaluate(() => document.fonts.ready);

const written = [];

for (const post of selected) {
  const formats = post.formats || ["square"];

  for (const format of formats) {
    const height = format === "story" ? 1920 : 1080;
    await page.setViewportSize({ width: 1080, height });
    await page.evaluate((c) => window.__card.setContent(c), { ...post, format });

    if (format === "square") {
      const file = path.join(outDir, `${post.id}.png`);
      // Captured at DURATION: every cue has closed and the card is at rest.
      await page.evaluate((t) => window.__card.render(t), 6);
      await page.screenshot({ path: file, animations: "disabled" });
      written.push(file);
      console.log(`  png  ${post.id}.png`);
      continue;
    }

    const frameDir = await mkdtemp(path.join(tmpdir(), `da3wa-social-${post.id}-`));
    const duration = await page.evaluate(() => window.__card.DURATION);
    const total = Math.round(duration * FPS);

    for (let i = 0; i < total; i++) {
      await page.evaluate((t) => window.__card.render(t), i / FPS);
      await page.screenshot({
        path: path.join(frameDir, `f${String(i).padStart(4, "0")}.png`),
        animations: "disabled",
      });
    }

    const file = path.join(outDir, `${post.id}-reel.mp4`);
    const ff = ["-y", "-framerate", String(FPS), "-i", path.join(frameDir, "f%04d.png")];
    if (audio) ff.push("-i", audio, "-shortest", "-c:a", "aac", "-b:a", "160k");
    ff.push(
      "-c:v", "libx264", "-preset", "slow", "-crf", "20",
      // yuv420p is the one pixel format every phone decoder accepts.
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      file
    );
    await run(ffmpeg, ff);
    await rm(frameDir, { recursive: true, force: true });
    written.push(file);
    console.log(`  mp4  ${post.id}-reel.mp4`);
  }

  // The caption travels with the artwork, in the file next to it.
  const captionFile = path.join(outDir, `${post.id}.txt`);
  await writeFile(
    captionFile,
    [`[${post.day}] ${post.id}`, "", post.caption || "", "", post.hashtags || ""].join("\n"),
    "utf8"
  );
}

await browser.close();
console.log(`\ndone -> ${outDir}  (${written.length} media files)`);
