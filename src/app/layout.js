import { Rubik, Aref_Ruqaa } from "next/font/google";
import "./globals.css";

// Rubik: the UI face for dashboards, forms and body text. Chosen over a
// single-script Arabic face because this app constantly mixes scripts —
// phone numbers, scanner codes like A1B2C3D4, URLs — and Rubik draws Arabic
// and Latin as one family, so a code sitting inside an Arabic sentence no
// longer falls back to whatever the device happens to have. Its 300–900
// weight range is what lets the type scale actually express hierarchy.
const rubik = Rubik({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-ui",
  display: "swap",
});

// Aref Ruqaa: an elegant calligraphic Arabic display face used for wedding
// headings — couple names, "بسم الله" openers — anywhere the invitation
// itself needs to feel handwritten and ceremonial rather than app-like.
const arefRuqaa = Aref_Ruqaa({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-display",
  display: "swap",
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.da3wa.digital";

export const metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Da3wa — دعوات أفراح إلكترونية",
    template: "%s — Da3wa",
  },
  description:
    "دعوة زفاف إلكترونية بلينك شخصي لكل ضيف، تأكيد حضور، وQR للدخول يوم الفرح.",
  // Invite links are shared almost entirely over WhatsApp, which renders a
  // preview card from these tags. Without them the guest's first impression
  // of the invitation is a bare URL.
  openGraph: {
    type: "website",
    locale: "ar_AR",
    siteName: "Da3wa",
    title: "دعوة زفاف إلكترونية",
    description: "افتح دعوتك الشخصية وأكّد حضورك.",
  },
  robots: {
    // Personal invite links must never end up in a search index.
    index: false,
    follow: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Never disable zoom — guests read this on their own phones, at their own
  // text size, and the door staff zoom into QR codes.
  maximumScale: 5,
  themeColor: "#faf6ef",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={`${rubik.variable} ${arefRuqaa.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
