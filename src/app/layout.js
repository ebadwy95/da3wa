import { Tajawal, Aref_Ruqaa } from "next/font/google";
import "./globals.css";

// Tajawal: clean modern Arabic UI font for the dashboards and body text.
// Aref Ruqaa: an elegant calligraphic Arabic display face used for wedding
// headings — couple names, "بسم الله" openers — anywhere the invitation
// itself needs to feel handwritten/ceremonial rather than app-like.
const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-ui",
  display: "swap",
});

const arefRuqaa = Aref_Ruqaa({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "Da3wa — دعوات أفراح إلكترونية",
  description: "دعوة زفاف إلكترونية بلينك شخصي لكل ضيف، تأكيد حضور، وQR للدخول.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${arefRuqaa.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
