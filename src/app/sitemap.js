// Served at /sitemap.xml. Only the two public pages — everything else is
// either behind a password or reachable solely through a link meant for one
// guest, and neither belongs in a sitemap.

import { siteOrigin } from "@/lib/seo";

export default function sitemap() {
  const lastModified = new Date();
  return [
    { url: `${siteOrigin()}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${siteOrigin()}/start`, lastModified, changeFrequency: "monthly", priority: 0.8 },
  ];
}
