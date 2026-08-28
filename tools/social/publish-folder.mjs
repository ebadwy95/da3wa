// Arranges the rendered output into a delivery folder you upload from.
//
//   node tools/social/publish-folder.mjs
//   node tools/social/publish-folder.mjs --dest "C:/Users/Eslam/OneDrive/Desktop/Da3wa Marketing"
//
// Run render-posts.mjs first; this only copies and organises what that made.
//
// The shape is per-platform rather than per-post, because that is how the work
// actually gets done: you sit down to do Instagram, you open one folder, and
// everything in it is for Instagram in the order it goes out. Reels and TikTok
// get their own copies of the same MP4 for the same reason — one folder per
// sitting beats one file shared between two.
//
// Filenames are the post id from posts.json, unchanged. The id leads with its
// publishing order (01…07) so the folder sorts into the schedule on its own,
// and it is the same string written in MARKETING.md, so searching the plan for
// "03-door" finds the row, the caption and the file.

import { mkdir, copyFile, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (argv[i]?.startsWith("--")) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv);
const src = path.resolve(args.src || path.join(ROOT, "social-out"));
const dest = path.resolve(args.dest || "C:/Users/Eslam/OneDrive/Desktop/Da3wa Marketing");

const exists = (p) => access(p).then(() => true, () => false);

const { posts } = JSON.parse(await readFile(path.join(HERE, "posts.json"), "utf8"));

const DIRS = {
  igPosts: path.join(dest, "Instagram", "Posts"),
  igReels: path.join(dest, "Instagram", "Reels"),
  tiktok: path.join(dest, "TikTok", "Videos"),
};
for (const dir of Object.values(DIRS)) await mkdir(dir, { recursive: true });

const index = [];
let copied = 0;

// A caption travels with every copy of its artwork. Splitting them is how the
// wrong words end up under the right picture.
async function place(from, to) {
  if (!(await exists(from))) return false;
  await copyFile(from, to);
  copied++;
  return true;
}

for (const post of posts) {
  const id = post.id;
  const png = path.join(src, `${id}.png`);
  const mp4 = path.join(src, `${id}-reel.mp4`);
  const txt = path.join(src, `${id}.txt`);

  const row = { id, day: post.day, headline: post.headline, post: false, reel: false };

  if (await place(png, path.join(DIRS.igPosts, `${id}.png`))) {
    row.post = true;
    await place(txt, path.join(DIRS.igPosts, `${id}.txt`));
  }

  if (await exists(mp4)) {
    row.reel = true;
    await place(mp4, path.join(DIRS.igReels, `${id}.mp4`));
    await place(txt, path.join(DIRS.igReels, `${id}.txt`));
    await place(mp4, path.join(DIRS.tiktok, `${id}.mp4`));
    await place(txt, path.join(DIRS.tiktok, `${id}.txt`));
  }

  index.push(row);
}

const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - String(s).length));

const readme = [
  "دعوة — ملفات النشر",
  "=".repeat(60),
  "",
  "اسم كل ملف هو رقم البوست ومعرّفه. ابحث عن نفس الاسم في MARKETING.md",
  "تلاقي الفكرة والكابشن والهاشتاجات بتاعته.",
  "",
  "الترتيب من اليسار = ترتيب النشر. ابدأ بـ 01 وامشي.",
  "",
  "Instagram/Posts  — صور مربعة 1080×1080 للجريد",
  "Instagram/Reels  — فيديو رأسي 1080×1920",
  "TikTok/Videos    — نفس فيديوهات الريلز، نسخة منفصلة عشان ترفع من فولدر واحد",
  "",
  "جنب كل ملف فيه .txt فيه الكابشن والهاشتاجات — انسخ منه، متكتبش من الأول.",
  "",
  "=".repeat(60),
  "",
  pad("الملف", 16) + pad("اليوم", 10) + "الفكرة",
  "-".repeat(60),
  ...index.map(
    (r) =>
      pad(r.id, 16) +
      pad(r.day, 10) +
      r.headline +
      (r.post && r.reel ? "   [بوست + ريل]" : r.reel ? "   [ريل]" : "   [بوست]")
  ),
  "",
  "=".repeat(60),
  "",
  "لتعديل أي بوست أو إضافة جديد:",
  "  tools/social/posts.json   ← النصوص",
  "  node tools/social/render-posts.mjs",
  "  node tools/social/publish-folder.mjs",
  "",
].join("\r\n"); // CRLF so Notepad does not run it all onto one line

await writeFile(path.join(dest, "00-اقرأني.txt"), readme, "utf8");

const plan = path.join(ROOT, "MARKETING.md");
if (await exists(plan)) await copyFile(plan, path.join(dest, "MARKETING.md"));

console.log(`\n${dest}`);
for (const r of index) {
  console.log(`  ${pad(r.id, 14)} ${r.post ? "png" : "   "} ${r.reel ? "mp4" : "   "}  ${r.headline}`);
}
console.log(`\n${copied} files placed.`);
