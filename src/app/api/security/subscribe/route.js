import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { resolveGuard, raiseSecurityAlert, pushIsConfigured } from "@/lib/security";

// A security contact's phone signing up for gate alerts, from their personal
// /guard link. The link's key is the only credential: it names the wedding and
// the person, and is signed.
//
// Every successful activation is answered with a test notification to that
// person, so they see — on the spot, with the admin standing next to them —
// that their phone rings, instead of finding out on the night that it does not.
export async function POST(request) {
  const { key, subscription } = await request.json().catch(() => ({}));
  const guard = resolveGuard(await getDb(), key);
  if (!guard) return NextResponse.json({ error: "الرابط غير صالح" }, { status: 401 });
  if (!pushIsConfigured()) {
    return NextResponse.json({ error: "التنبيهات غير مفعّلة على الخادم" }, { status: 503 });
  }

  const endpoint = String(subscription?.endpoint || "");
  const keys = subscription?.keys;
  if (!/^https:\/\//.test(endpoint) || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "اشتراك غير صالح" }, { status: 400 });
  }

  await withDb((db) => {
    db.pushSubscriptions = (db.pushSubscriptions || []).filter((s) => s.endpoint !== endpoint);
    db.pushSubscriptions.push({
      endpoint,
      keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) },
      eventId: guard.event.id,
      contactId: guard.contact.id,
      userAgent: String(request.headers.get("user-agent") || "").slice(0, 200),
      createdAt: new Date().toISOString(),
    });
  });

  const test = await raiseSecurityAlert({
    eventId: guard.event.id,
    type: "test",
    onlyContactId: guard.contact.id,
  });
  return NextResponse.json({ ok: true, testDelivered: test.notified.length > 0 });
}

export async function DELETE(request) {
  const { key, endpoint } = await request.json().catch(() => ({}));
  const guard = resolveGuard(await getDb(), key);
  if (!guard) return NextResponse.json({ error: "الرابط غير صالح" }, { status: 401 });
  await withDb((db) => {
    db.pushSubscriptions = (db.pushSubscriptions || []).filter(
      (s) => !(s.endpoint === endpoint && s.contactId === guard.contact.id)
    );
  });
  return NextResponse.json({ ok: true });
}
