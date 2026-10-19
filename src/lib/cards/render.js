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
//
// playwright-core is imported inside launch(), never at the top of this file.
// This module sits on the RSVP path (the confirm route draws the entry pass),
// and a static import meant that a browser package missing a file on the
// server took the whole route down at load time — every guest who pressed
// "confirm" got an error and their answer was never recorded. Loaded lazily,
// the worst a broken browser can do is cost a guest their card image.
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
  const { chromium: playwright } = await import("playwright-core");
  if (isServerless()) {
    const { default: chromium } = await import("@sparticuz/chromium");
    return playwright.launch({
      // Everything @sparticuz/chromium recommends, except --single-process.
      //
      // In single-process mode the page is rendered inside the browser process
      // itself, and when that one process trips over something heavy — a page
      // waiting on web fonts, in our case — it takes the whole browser down
      // and Playwright reports it as "Target page, context or browser has been
      // closed". It cost this wedding half its entry passes. A separate
      // renderer process costs a little more memory and simply does not do
      // that.
      args: chromium.args.filter((flag) => flag !== "--single-process"),
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

// One render, one browser, no reuse.
//
// Chromium dies here more often than it has any right to. On a container that
// has already drawn a card, the next launch comes up and then falls over
// mid-page — "Target page, context or browser has been closed" — which is what
// a browser killed for memory looks like from the outside. Half of one
// wedding's hundred and thirty passes failed that way, every one of them a
// guest who would have been handed a broken image at the door.
//
// So the attempt is cheap and the second attempt is free: the first browser is
// gone by then, its memory with it, and a retry on a settled container usually
// draws the card the first one died on.
async function drawOnce(html, { width, height, locale }) {
  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      locale,
    });
    const page = await context.newPage();
    // Not "networkidle": every asset this page needs is inlined or a data URL,
    // so waiting for the network to go quiet only keeps a heavy page alive
    // longer. The fonts are the one thing worth waiting for, and they are
    // waited for by name below.
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    // The web fonts are the whole design; a screenshot taken before they land
    // is the card in Times New Roman.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(120);
    return await page.screenshot({ type: "png", animations: "disabled" });
  } finally {
    await browser.close().catch(() => {});
  }
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
  try {
    return await drawOnce(html, { width, height, locale });
  } catch (err) {
    console.warn("[cards] first render died, trying once more:", err.message);
    return await drawOnce(html, { width, height, locale });
  }
}

/**
 * Renders a full HTML document to a PDF buffer, A4 portrait.
 *
 * Same browser, same reason: the door list is Arabic, and a PDF library that
 * lays out glyphs one after another gives the security team a page of
 * disconnected letters. printBackground is on because the sheet's only
 * structure — the rule down the middle between the two columns — is drawn
 * with a background.
 */
export async function renderHtmlToPdf(html, { locale = "ar" } = {}) {
  const browser = await launch();
  try {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(120);
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });
  } finally {
    await browser.close().catch(() => {});
  }
}
