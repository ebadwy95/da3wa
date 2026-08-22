import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getScannerSession, createScannerSession, clearScannerSession } from "@/lib/scannerAuth";

// Separate login for the door scanner (/scan) — NOT the platform admin
// password. Each wedding gets its own scannerCode (shown in the admin
// dashboard), so when two weddings happen the same day, each door's staff
// logs in with THEIR wedding's code and can only check in THAT wedding's
// guests. Each staff member also types their own name at login, so every
// check-in they make is attributed to them (see checkinLogs in /api/checkin).
export async function GET() {
  const session = await getScannerSession();
  if (!session) return NextResponse.json({ authed: false });

  const db = await getDb();
  const event = db.events.find((e) => e.id === session.eventId);
  if (!event) return NextResponse.json({ authed: false });

  return NextResponse.json({
    authed: true,
    event: { id: event.id, coupleNames: event.coupleNames },
    staffName: session.staffName,
  });
}

export async function POST(request) {
  const { code, staffName } = await request.json().catch(() => ({}));
  const cleanCode = String(code || "").trim().toUpperCase();
  const cleanStaffName = String(staffName || "").trim();
  if (!cleanCode) {
    return NextResponse.json({ error: "يجب إدخال رمز الزفاف" }, { status: 400 });
  }
  if (!cleanStaffName) {
    return NextResponse.json({ error: "يجب كتابة اسمك — سيُسجَّل مع كل عملية دخول تقوم بها" }, { status: 400 });
  }

  const db = await getDb();
  const event = db.events.find((e) => e.scannerCode === cleanCode);
  if (!event) {
    return NextResponse.json({ error: "الرمز غير صحيح" }, { status: 401 });
  }

  await createScannerSession(event.id, cleanStaffName);

  return NextResponse.json({
    ok: true,
    event: { id: event.id, coupleNames: event.coupleNames },
    staffName: cleanStaffName,
  });
}

export async function DELETE() {
  await clearScannerSession();
  return NextResponse.json({ ok: true });
}
