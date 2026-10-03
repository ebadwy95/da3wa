import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getScannerSession } from "@/lib/scannerAuth";
import { liveAlertsFor, resolveGuard } from "@/lib/security";

// The live alert list, polled by the two screens that care about it:
//  - the door scanner (its session), which also gets the team's phone
//    numbers for the one-tap call buttons;
//  - a guard's page (their key), as the fallback for a notification that
//    did not arrive — while the page is open it rings on its own.
export const dynamic = "force-dynamic";

export async function GET(request) {
  const db = await getDb();
  const key = new URL(request.url).searchParams.get("key");

  if (key) {
    const guard = resolveGuard(db, key);
    if (!guard) return NextResponse.json({ error: "الرابط غير صالح" }, { status: 401 });
    return NextResponse.json({
      alerts: liveAlertsFor(db, guard.event.id, { viewerContactId: guard.contact.id }),
      devices: (db.pushSubscriptions || []).filter((s) => s.contactId === guard.contact.id).length,
    });
  }

  const scanner = await getScannerSession();
  if (scanner) {
    const event = db.events.find((e) => e.id === scanner.eventId);
    const subscribed = new Set(
      (db.pushSubscriptions || []).filter((s) => s.eventId === scanner.eventId).map((s) => s.contactId)
    );
    return NextResponse.json({
      alerts: liveAlertsFor(db, scanner.eventId),
      contacts: (event?.securityContacts || []).map((c) => ({
        name: c.name,
        phone: c.phone,
        reachable: subscribed.has(c.id),
      })),
    });
  }

  return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
}
