import { PRIVATE_ROUTE_METADATA } from "@/lib/seo";

// This route is private — see src/lib/seo.js for why the opt-out lives here
// rather than on the root layout.
//
// Installable as its own app ("add to home screen"), opening straight on the
// dashboard instead of the public site.
export const metadata = {
  ...PRIVATE_ROUTE_METADATA,
  manifest: "/couple.webmanifest",
  appleWebApp: { capable: true, title: "دعوة العروسين", statusBarStyle: "default" },
  icons: { apple: "/icons/couple-192.png" },
};

export const viewport = { themeColor: "#f6efe2" };

export default function Layout({ children }) {
  return children;
}
