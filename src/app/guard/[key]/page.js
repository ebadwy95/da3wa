import { getDb } from "@/lib/db";
import { resolveGuard } from "@/lib/security";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo";
import { formatEventDateArabic } from "@/lib/date";
import GuardScreen from "./GuardScreen";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { key } = await params;
  return {
    ...PRIVATE_ROUTE_METADATA,
    title: "تنبيهات الأمن — دعوة",
    manifest: `/guard/${key}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "أمن دعوة", statusBarStyle: "black" },
    icons: { apple: "/icons/guard-192.png" },
  };
}

export const viewport = { themeColor: "#a6321f" };

export default async function GuardPage({ params }) {
  const { key } = await params;
  const guard = resolveGuard(await getDb(), key);

  if (!guard) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card max-w-sm w-full p-8 text-center flex flex-col gap-3">
          <h1 className="title" style={{ color: "var(--danger)" }}>الرابط غير صالح</h1>
          <p className="meta leading-relaxed">
            يمكن يكون اسمك اتشال من فريق الأمن للفرح ده، أو الرابط ناقص. اطلب رابط جديد من إدارة دعوة.
          </p>
        </div>
      </main>
    );
  }

  return (
    <GuardScreen
      guardKey={key}
      contactName={guard.contact.name}
      coupleNames={guard.event.coupleNames}
      eventDate={formatEventDateArabic(guard.event.eventDate)}
      venueName={guard.event.venueName || ""}
      vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""}
    />
  );
}
