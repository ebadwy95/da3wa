import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { resolveGuard } from "@/lib/security";

// "On my way" — from the guard page, or straight from the notification's
// button. The scanner polls for this, so the person at the gate sees who is
// coming instead of wondering whether anyone got the call.
export async function POST(request) {
  const { key, alertId } = await request.json().catch(() => ({}));
  const guard = resolveGuard(await getDb(), key);
  if (!guard) return NextResponse.json({ error: "الرابط غير صالح" }, { status: 401 });

  const found = await withDb((db) => {
    const alert = (db.securityAlerts || []).find(
      (a) => a.id === alertId && a.eventId === guard.event.id
    );
    if (!alert) return false;
    alert.acks = alert.acks || [];
    if (!alert.acks.some((a) => a.contactId === guard.contact.id)) {
      alert.acks.push({ contactId: guard.contact.id, at: new Date().toISOString() });
    }
    return true;
  });
  if (!found) return NextResponse.json({ error: "التنبيه غير موجود" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
