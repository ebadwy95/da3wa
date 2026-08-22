import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getScannerEventId, createScannerSession, clearScannerSession } from "@/lib/scannerAuth";

// Separate login for the door scanner (/scan) — NOT the platform admin
// password. Each wedding gets its own scannerCode (shown in the admin
// dashboard), so when two weddings happen the same day, each door's staff
// logs in with THEIR wedding's code and can only check in THAT wedding's
// guests.
export async function GET() {
  const eventId = await getScannerEventId();
  if (!eventId) return NextResponse.json({ authed: false });

  const db = await getDb();
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return NextResponse.json({ authed: false });

  return NextResponse.json({
    authed: true,
    event: { id: event.id, coupleNames: event.coupleNames },
  });
}

export async function POST(request) {
  const { code } = await request.json().catch(() => ({}));
  const cleanCode = String(code || "").trim().toUpperCase();
  if (!cleanCode) {
    return NextResponse.json({ error: "لازم تدخل كود الزفاف" }, { status: 400 });
  }

  const db = await getDb();
  const event = db.events.find((e) => e.scannerCode === cleanCode);
  if (!event) {
    return NextResponse.json({ error: "الكود غير صحيح" }, { status: 401 });
  }

  await createScannerSession(event.id);

  return NextResponse.json({
    ok: true,
    event: { id: event.id, coupleNames: event.coupleNames },
  });
}

export async function DELETE() {
  await clearScannerSession();
  return NextResponse.json({ ok: true });
}
