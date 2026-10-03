import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { getScannerSession } from "@/lib/scannerAuth";
import { raiseSecurityAlert, resolveGuard } from "@/lib/security";

// Raises an alert by hand:
//  - the door scanner's SOS button (a scanner session, scoped to its wedding);
//  - a test from the admin dashboard, to every phone on the team;
//  - a test from a guard's own page, to their own phones only.
// The duplicate-code alarm is not raised here — the check-in route raises it
// itself, so it never depends on the scanner page doing its part.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const type = body.type === "sos" ? "sos" : "test";

  if (body.key) {
    const guard = resolveGuard(await getDb(), body.key);
    if (!guard) return NextResponse.json({ error: "الرابط غير صالح" }, { status: 401 });
    const result = await raiseSecurityAlert({
      eventId: guard.event.id,
      type: "test",
      onlyContactId: guard.contact.id,
    });
    return NextResponse.json({ ok: true, notified: result.notified });
  }

  const scanner = await getScannerSession();
  if (scanner) {
    const result = await raiseSecurityAlert({
      eventId: scanner.eventId,
      type,
      staffName: scanner.staffName || null,
    });
    return NextResponse.json({ ok: true, alertId: result.alert.id, notified: result.notified });
  }

  if (await isAdminAuthed()) {
    if (!body.eventId) return NextResponse.json({ error: "حدّد الزفاف" }, { status: 400 });
    const result = await raiseSecurityAlert({
      eventId: body.eventId,
      type,
      staffName: "مسؤول المنصة",
    });
    return NextResponse.json({ ok: true, alertId: result.alert.id, notified: result.notified });
  }

  return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
}
