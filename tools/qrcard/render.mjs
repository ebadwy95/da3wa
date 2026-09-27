// Renders a sample entry pass to a PNG, without running the app.
//
//   node tools/qrcard/render.mjs --out card.png [--lang en] [--guest "..."]
//
// The design itself lives in src/lib/cards/scene.js — the same module the
// server renders from — so this is only a way to look at a change without a
// database, a guest and a running dev server.
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QR from "qrcode";
import { qrCardHtml, CARD_WIDTH, CARD_HEIGHT } from "../../src/lib/cards/scene.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const lang = arg("lang", "ar");
const en = lang === "en";

const html = qrCardHtml({
  lang,
  qr: await QR.toDataURL(arg("code", "sample.checkin.code"), {
    errorCorrectionLevel: "M", margin: 0, width: 720,
    color: { dark: "#2c2620", light: "#ffffff" },
  }),
  coupleNames: arg("couple", en ? "Islam & Dima" : "إسلام و ديما"),
  guestName: arg("guest", en ? "Emad" : "عماد"),
  seats: arg("seats", en ? "Admits 4" : "يشمل 4 أشخاص"),
  dateLine: arg("date", en ? "Thursday, 22 October 2026 — 8:00 PM" : "22 أكتوبر 2026 — 8:00 مساءً"),
  venueLine: arg("venue", en ? "Al Zumorroda Halls — Al Jawhara Hall" : "قاعات الزمردة — قاعة الجوهرة"),
});

const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const out = path.resolve(arg("out", path.join(HERE, `qr-${lang}.png`)));
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext({
  viewport: { width: CARD_WIDTH, height: CARD_HEIGHT }, deviceScaleFactor: 1, locale: en ? "en" : "ar",
})).newPage();
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(150);
await page.screenshot({ path: out, animations: "disabled" });
await browser.close();
console.log(`done -> ${out}`);
