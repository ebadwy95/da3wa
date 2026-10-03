import { PRIVATE_ROUTE_METADATA } from "@/lib/seo";

// This route is private — see src/lib/seo.js for why the opt-out lives here
// rather than on the root layout.
//
// The door scanner installs as its own app ("add to home screen"), separate
// from the site: the camera opens straight away, and the SOS button is one
// tap from the lock screen instead of a browser tab away.
export const metadata = {
  ...PRIVATE_ROUTE_METADATA,
  manifest: "/scan.webmanifest",
  appleWebApp: { capable: true, title: "سكانر دعوة", statusBarStyle: "black" },
  icons: { apple: "/icons/scan-192.png" },
};

export const viewport = { themeColor: "#17140f" };

export default function Layout({ children }) {
  return children;
}
