import { PRIVATE_ROUTE_METADATA } from "@/lib/seo";

// Private — see src/lib/seo.js. Installs as its own app: the groom and the
// bride keep it on their home screen next to WhatsApp, apart from the
// dashboard.
export const metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "إرسال دعوة",
  manifest: "/send.webmanifest",
  appleWebApp: { capable: true, title: "إرسال دعوة", statusBarStyle: "default" },
  icons: { apple: "/icons/send-192.png" },
};

export const viewport = { themeColor: "#1d5c47" };

export default function Layout({ children }) {
  return children;
}
