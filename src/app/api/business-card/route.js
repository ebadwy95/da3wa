import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { isAdminAuthed } from "@/lib/auth";
import { siteOrigin } from "@/lib/seo";
import { businessCardHtml, CARD_W, CARD_H } from "@/lib/cards/businessCard";

// The business card, rendered the same way the entry pass is — by a browser,
// because it is mostly Arabic and Arabic has to be shaped, not measured.
//
// Four files, from one route:
//   ?lang=ar|en  &side=front|back
// and ?format=pdf for the thing to hand a printer.
//
// The QR is a choice rather than a default. ?qr=demo points at the live
// stand (someone scans it and is holding a working invitation ten seconds
// later); ?qr=site points at the website, which is the right answer when the
// card is going into a wallet to be looked at later.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PERSON = {
  name: { ar: "م. عمر الطيباوي", en: "Eng. Omar Al-Tibawi" },
  phone: "+965 9788 9803",
  email: "hello@da3wa.digital",
  site: "www.da3wa.digital",
};

export async function GET(request) {
  // Admin only: it carries a person's direct number, and it is an artwork
  // file rather than anything a guest needs.
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lang = searchParams.get("lang") === "en" ? "en" : "ar";
  const side = searchParams.get("side") === "back" ? "back" : "front";
  const which = searchParams.get("qr") === "site" ? "site" : "demo";
  const base = siteOrigin();

  const target = which === "site" ? base : `${base}/demo`;
  const qr = await QRCode.toDataURL(target, {
    errorCorrectionLevel: "Q", // printed small, and read off paper under bad light
    margin: 1,
    width: 900,
    color: { dark: "#2c2620", light: "#ffffff" },
  });

  const scanNote =
    which === "site"
      ? lang === "en"
        ? "Scan for da3wa.digital"
        : "امسح لزيارة الموقع"
      : lang === "en"
        ? "Scan to try a real invitation"
        : "امسح وجرّب دعوة حقيقية";

  const html = businessCardHtml({ side, lang, qr, scanNote, ...PERSON, name: PERSON.name[lang] });

  if (searchParams.get("format") === "html") {
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const { renderHtmlToPng, renderHtmlToPdf } = await import("@/lib/cards/render");

  if (searchParams.get("format") === "pdf") {
    const pdf = await renderHtmlToPdf(html, { locale: lang });
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="da3wa-card-${lang}-${side}-${which}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const png = await renderHtmlToPng(html, { width: CARD_W, height: CARD_H, locale: lang });
  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="da3wa-card-${lang}-${side}-${which}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
