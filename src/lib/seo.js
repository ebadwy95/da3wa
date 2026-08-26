// Which routes search engines may look at.
//
// The whole site used to carry noindex, set once on the root layout to keep
// personal invite links out of search results. The intent was right and the
// scope was wrong: it also hid the landing page, which is the only page that
// is supposed to be found — and it is what made Meta's business verification
// fail, since the crawler will not treat a noindex page as a business website
// no matter what is written on it.
//
// So the default is now indexable and the private routes opt out, one layout
// each. Everything reachable only by a link nobody should be able to guess,
// or behind a password, belongs in that list.

/** Applied by the layout of every route that must stay out of search results. */
export const PRIVATE_ROUTE_METADATA = {
  robots: {
    index: false,
    follow: false,
    // Stops the preview snippet and thumbnail as well: a search result that
    // shows a guest's name is a leak even when the page itself is unlisted.
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

/** Path prefixes disallowed in robots.txt. Keep in step with the layouts. */
export const PRIVATE_PATHS = ["/invite/", "/admin", "/couple", "/scan", "/api/"];

/** The canonical origin, for robots.txt and the sitemap. */
export const CANONICAL_ORIGIN = "https://www.da3wa.digital";

/**
 * NEXT_PUBLIC_BASE_URL is whatever the current deployment is reachable at —
 * localhost in development, a preview URL on a branch. Fine for building an
 * invite link, wrong in a sitemap: a build with the local value set shipped
 * "Sitemap: http://localhost:3000/sitemap.xml". Anything that is not the real
 * site falls back to the canonical origin.
 */
export function siteOrigin() {
  const raw = process.env.NEXT_PUBLIC_BASE_URL;
  if (!raw) return CANONICAL_ORIGIN;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return CANONICAL_ORIGIN;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return CANONICAL_ORIGIN;
    return url.origin;
  } catch {
    return CANONICAL_ORIGIN;
  }
}
