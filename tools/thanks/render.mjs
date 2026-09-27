// Renders a sample thank-you card to a PNG, without running the app.
//
//   node tools/thanks/render.mjs --out card.png [--lang en] [--names "..."]
//
// The design lives in src/lib/cards/scene.js, next to the entry pass; this is
// only a way to look at a change quickly.
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { thanksCardHtml, CARD_WIDTH, CARD_HEIGHT } from "../../src/lib/cards/scene.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const lang = arg("lang", "ar");
const en = lang === "en";

const html = thanksCardHtml({
  lang,
  headline: arg("headline", en ? "Thank you for being with us" : "شكرًا لحضوركم"),
  body: arg("body", en
    ? "Having you with us on our night was the best gift of all, and your kind words reached our hearts. Thank you, from both of us."
    : "وجودكم بيننا في ليلتنا كان أجمل هدية، ودعواتكم الطيبة وصلت لقلوبنا. جزاكم الله خيرًا وجمعنا بكم دائمًا على الخير."),
  coupleNames: arg("names", en ? "Islam & Dima" : "إسلام و ديما"),
  dateLine: arg("date", en ? "Thursday, 22 October 2026" : "22 أكتوبر 2026"),
});

const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const out = path.resolve(arg("out", path.join(HERE, `thanks-${lang}.png`)));
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
