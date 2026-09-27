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
  // @sparticuz/chromium is the same story, one directory bigger: the browser
  // itself is a packed file in its bin/ that nothing imports.
  // The routes that draw a card say so explicitly. The keys are globs, so a
  // dynamic segment is written as * — "[id]" is a glob character class that
  // matches the single letter i or d, and the confirm route silently got none
  // of these files because of it.
  outputFileTracingIncludes: {
    "/api/cards/qr/*/card.png": [
      "./node_modules/playwright-core/**",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
    "/api/cards/thanks/*/card.png": [
      "./node_modules/playwright-core/**",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
    "/api/cron/thanks": [
      "./node_modules/playwright-core/**",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
    "/api/guests/*/confirm": [
      "./node_modules/playwright-core/**",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
};

export default nextConfig;
