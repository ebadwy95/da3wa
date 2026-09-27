/** @type {import('next').NextConfig} */
const nextConfig = {
  // The WhatsApp cards are drawn by a real browser (see src/lib/cards/render.js).
  //
  // Both of these packages are loaded, not bundled: playwright-core reaches for
  // its own files at runtime, and @sparticuz/chromium is a compressed browser
  // that has to stay a file on disk. Bundling either one breaks it.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],

  // Next traces which files each function needs by following imports, and
  // playwright-core reads browsers.json by path rather than importing it — so
  // nothing points at it and it was left out of the deployed function:
  // "Cannot find module '/var/task/node_modules/playwright-core/browsers.json'".
  // The routes that draw a card say so explicitly.
  outputFileTracingIncludes: {
    "/api/cards/qr/[id]/card.png": ["./node_modules/playwright-core/**"],
    "/api/cards/thanks/[id]/card.png": ["./node_modules/playwright-core/**"],
    "/api/cron/thanks": ["./node_modules/playwright-core/**"],
    "/api/guests/[id]/confirm": ["./node_modules/playwright-core/**"],
  },
};

export default nextConfig;
