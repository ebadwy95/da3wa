import "./globals.css";

export const metadata = {
  title: "Da3wa — دعوات أفراح إلكترونية",
  description: "دعوة فرح إلكترونية بلينك شخصي لكل ضيف، تأكيد حضور، وQR للدخول.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
