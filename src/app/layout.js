import { Rubik, Aref_Ruqaa, Amiri } from "next/font/google";
import "./globals.css";
import { siteOrigin } from "@/lib/seo";

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

// Amiri: a naskh, used on the invitation itself. Rubik is a Latin family with
// Arabic added — fine for a dashboard, but on a wedding card its Arabic reads
// like a form control next to Aref Ruqaa's calligraphy. Amiri sits with the
// display face instead of against it, and stays legible at button size, which
// Aref Ruqaa does not.
const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-card",
  display: "swap",
});

export const metadata = {
  // siteOrigin() rather than NEXT_PUBLIC_BASE_URL directly: that variable is
  // whatever the current deployment answers on, and a build carrying the local
  // value emitted `og:image = http://localhost:3000/og.png`. A preview card
  // pointing at localhost is broken for every person who sees the link, so
  // anything that is not the real site falls back to the canonical origin.
  metadataBase: new URL(siteOrigin()),
  title: {
    default: "Da3wa — دعوات إلكترونية للمناسبات",
    template: "%s — Da3wa",
  },
  description:
    "دعوة إلكترونية بلينك شخصي لكل ضيف، تأكيد حضور، ورمز دخول يُمسح على الباب.",
  // Invite links are shared almost entirely over WhatsApp, which renders a
  // preview card from these tags. Without them the guest's first impression
  // of the invitation is a bare URL.
  openGraph: {
    type: "website",
    locale: "ar_AR",
    siteName: "Da3wa",
    title: "دعوة إلكترونية",
    description: "افتح دعوتك الشخصية وأكّد حضورك.",
    // Meta's sharing debugger flagged the missing image: without it the link
    // renders as a bare grey box wherever it is pasted. Regenerate with
    // `node tools/social/render-og.mjs` — it uses the same scene as the
    // social cards, so the preview and the grid read as one brand.
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "دعوة — دعوات إلكترونية للأعراس والمناسبات" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "دعوة إلكترونية",
    description: "افتح دعوتك الشخصية وأكّد حضورك.",
    images: ["/og.png"],
  },
  // No robots block here on purpose. Personal invite links must never end up
  // in a search index, but setting that on the root layout hid the landing
  // page too — and a noindex page cannot pass Meta's business verification,
  // whatever legal name is printed on it. The private routes now opt out
  // individually; see src/lib/seo.js.

  // This is what actually associates the domain with the business portfolio.
  // Four verification attempts failed on "we can't verify your website is
  // associated with فيرتكس سكاي ش ذ م م" while the legal name sat in the
  // footer in plain text — the association was never something written on the
  // page, it is this token matched against the one Meta issued. The domain had
  // simply never been added to the account.
  //
  // Token issued for da3wa.digital (the root domain — Meta verifies the root,
  // which covers www). Do not change or remove it: the WhatsApp Business API
  // depends on the verification it unlocks.
  other: {
    "facebook-domain-verification": "uhzq1vwbgqte75v5fmdtlnaqjg62ua",
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
    <html lang="ar" dir="rtl" className={`${rubik.variable} ${arefRuqaa.variable} ${amiri.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
