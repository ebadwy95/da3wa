import { PRIVATE_ROUTE_METADATA } from "@/lib/seo";

// This route is private — see src/lib/seo.js for why the opt-out lives here
// rather than on the root layout.
//
// Installable as its own app ("add to home screen"), opening straight on the
// dashboard instead of the public site.
export const metadata = {
  ...PRIVATE_ROUTE_METADATA,
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: "إدارة دعوة", statusBarStyle: "default" },
  icons: { apple: "/icons/admin-192.png" },
};

export const viewport = { themeColor: "#17140f" };

export default function Layout({ children }) {
  return children;
}
