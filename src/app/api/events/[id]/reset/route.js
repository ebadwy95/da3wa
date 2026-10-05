import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";

// Admin: wipes a wedding's guests and everything recorded about them — the
// message log, the door's check-in log, the security alerts — so a wedding
// set up with test guests can start again from a clean guest list.
//
// The wedding itself stays exactly as it is: its design and wording, the
// door scanner codes, the security team, the couple's and senders' logins.
//
// Permanent. The dashboard asks for the word "مسح" to be typed first, and
// this checks it again, so nothing else can trigger it by accident.
export async function POST(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const { confirm } = await request.json().catch(() => ({}));
  if (String(confirm || "").trim() !== "مسح") {
    return NextResponse.json({ error: "اكتب كلمة «مسح» للتأكيد" }, { status: 400 });
  }

  const removed = await withDb((db) => {
    if (!db.events.some((e) => e.id === id)) return null;
    const count = (list) => (list || []).filter((x) => x.eventId === id).length;
    const tally = {
      guests: count(db.guests),
      messages: count(db.messages),
      checkins: count(db.checkinLogs),
      alerts: count(db.securityAlerts),
    };
    db.guests = db.guests.filter((g) => g.eventId !== id);
    db.messages = db.messages.filter((m) => m.eventId !== id);
    db.checkinLogs = (db.checkinLogs || []).filter((l) => l.eventId !== id);
    db.securityAlerts = (db.securityAlerts || []).filter((a) => a.eventId !== id);
    return tally;
  });
  if (!removed) return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });
  return NextResponse.json({ ok: true, removed });
}
