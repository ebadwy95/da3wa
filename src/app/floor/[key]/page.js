import { getDb } from "@/lib/db";
import { parseFloorKey } from "@/lib/token";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo";
import FloorScreen from "./FloorScreen";

// The planner's screen. Everything it shows comes from /api/floor/<key>, so
// this page only checks the key and hands it over.
export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_ROUTE_METADATA, title: "القاعة الآن — دعوة" };
export const viewport = { themeColor: "#15110d" };

export default async function FloorPage({ params }) {
  const { key } = await params;
  const parsed = parseFloorKey(key);
  const event = parsed
    ? (await getDb()).events.find((e) => e.id === parsed.eventId)
    : null;

  if (!event) {
    return (
      <main className="floor-wrap">
        <div className="floor-card">
          <h1 className="title" style={{ color: "var(--danger)" }}>الرابط غير صالح</h1>
          <p className="meta leading-relaxed">
            يمكن أن يكون الرابط ناقصًا أو أن المناسبة انتهت. اطلب رابطًا جديدًا من إدارة دعوة.
          </p>
        </div>
      </main>
    );
  }

  return <FloorScreen floorKey={key} />;
}
