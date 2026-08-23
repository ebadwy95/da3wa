import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getScannerSession, createScannerSession, clearScannerSession } from "@/lib/scannerAuth";

// Separate login for the door scanner (/scan) — NOT the platform admin
// password. Each wedding can have several named scanner codes (see
// event.scanners in src/app/api/events/[id]/scanners), so when two weddings
// happen the same day, each door's staff logs in with THEIR wedding's code
// and can only check in THAT wedding's guests.
//
// The staff member does NOT type their own name here — that would let
// someone type a colleague's name and check guests in under it. Instead the
// ADMIN assigns a name to each code from the dashboard ahead of time, and
// logging in with a code simply picks up whichever name the admin attached
// to it (see checkinLogs in /api/checkin for how this is used as an audit
// trail).
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
  const { code } = await request.json().catch(() => ({}));
  const cleanCode = String(code || "").trim().toUpperCase();
  if (!cleanCode) {
    return NextResponse.json({ error: "يجب إدخال رمز الزفاف" }, { status: 400 });
  }

  const db = await getDb();
  let matchedEvent = null;
  let matchedScanner = null;
  for (const event of db.events) {
    const scanner = (event.scanners || []).find((s) => s.code === cleanCode);
    if (scanner) {
      matchedEvent = event;
      matchedScanner = scanner;
      break;
    }
  }

  if (!matchedEvent) {
    return NextResponse.json({ error: "الرمز غير صحيح" }, { status: 401 });
  }
  if (!matchedScanner.name) {
    return NextResponse.json(
      { error: "لم تُخصَّص هذه الشفرة باسم موظف بعد — تواصل مع الإدارة لتعيين اسم لها أولًا" },
      { status: 403 }
    );
  }

  await createScannerSession(matchedEvent.id, matchedScanner.name);

  return NextResponse.json({
    ok: true,
    event: { id: matchedEvent.id, coupleNames: matchedEvent.coupleNames },
    staffName: matchedScanner.name,
  });
}

export async function DELETE() {
  await clearScannerSession();
  return NextResponse.json({ ok: true });
}
