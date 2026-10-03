import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveGuard } from "@/lib/security";

// Each security contact's alert page installs as its own app, and the app has
// to open on THEIR page — so the manifest is per person, with their personal
// path as the start URL.
export async function GET(request, { params }) {
  const { key } = await params;
  const guard = resolveGuard(await getDb(), key);
  if (!guard) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(
    JSON.stringify({
      name: "دعوة — تنبيهات الأمن",
      short_name: "أمن دعوة",
      description: "نداءات الطوارئ من بوابة الدخول",
      id: `/guard/${key}`,
      start_url: `/guard/${key}`,
      scope: `/guard/${key}`,
      display: "standalone",
      orientation: "portrait",
      dir: "rtl",
      lang: "ar",
      background_color: "#a6321f",
      theme_color: "#a6321f",
      icons: [
        { src: "/icons/guard-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/guard-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/guard-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    }),
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    }
  );
}
