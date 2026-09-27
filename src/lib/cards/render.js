// HTML → PNG, in a real browser.
//
// Why a browser at all: the cards are mostly Arabic, and Arabic is not text
// that can be laid out by measuring glyphs one after another — the letters
// change shape by position and join to their neighbours. Next's own image
// generator (next/og, i.e. satori) refuses these fonts outright
// ("lookupType: 5 - substFormat: 3 is not yet supported"), and the one time it
// doesn't refuse, it draws the letters unjoined. A browser does the shaping
// the same way every phone does, so what we preview is what a guest gets.
//
// Locally that is the Chrome already installed on the machine; on Vercel it is
// @sparticuz/chromium, a build of Chromium packed to fit inside a serverless
// function. Both are driven through playwright-core.
import { chromium as playwright } from "playwright-core";
import { existsSync } from "node:fs";

// Where a desktop Chrome usually sits. Only consulted off Vercel.
const LOCAL_CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

function isServerless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function launch() {
  if (isServerless()) {
    const { default: chromium } = await import("@sparticuz/chromium");
    return playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const executablePath = LOCAL_CHROME.find((p) => existsSync(p));
  if (!executablePath) {
    throw new Error(
      "No local Chrome found for card rendering — set CHROME_PATH to a Chrome/Chromium binary."
    );
  }
  return playwright.launch({ executablePath, headless: true });
}

/**
 * Renders a full HTML document to a PNG buffer.
 *
 * The browser is launched per call and closed in a finally: a card is rendered
 * once per guest and cached (see ./index.js), so a long-lived browser would sit
 * idle far more often than it would be reused — and on serverless it would be
 * killed between invocations anyway.
 */
export async function renderHtmlToPng(html, { width, height, locale = "ar" } = {}) {
  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      locale,
    });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    // The web fonts are the whole design; a screenshot taken before they land
    // is the card in Times New Roman.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(120);
    return await page.screenshot({ type: "png", animations: "disabled" });
  } finally {
    await browser.close().catch(() => {});
  }
}
