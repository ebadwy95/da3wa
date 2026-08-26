import { PRIVATE_PATHS, siteOrigin } from "@/lib/seo";

// Served at /robots.txt. The per-route noindex tags are what actually keep
// guest pages out of results — this is the coarser, earlier signal, and the
// one a crawler reads before it requests anything.

export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
