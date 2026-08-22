import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withDb } from "@/lib/db";
import { verifyCheckinCode } from "@/lib/token";
import { isAdminAuthed } from "@/lib/auth";
import { getScannerSession } from "@/lib/scannerAuth";

// The door scanner posts the raw QR payload here. Two ways in: the platform
// admin password (full access, any event — for setup/testing), or a
// per-event scanner session from /api/scan-auth (scoped to ONE event, so a
// door scanning wedding A's QR codes can never check in wedding B's guests
// even if it somehow scanned one).
//
// A single QR is shared by the whole party (the guest + however many
// companions they confirmed) — every individual arriving scans/re-presents
// the SAME code, and each successful scan counts one more person in, up to
// the confirmed party size. Once the party size is reached, any further
// attempt to use that QR is rejected (and logged) rather than silently
// re-admitting someone — that's what stops a QR from being reused beyond
// what it was actually issued for.
//
// Every attempt — successful or not — is written to checkinLogs together
// with which scanner-staff member's session made it, so if something looks
// like misuse at the door (e.g. repeated attempts on an already-used QR),
// there's a record of exactly who scanned it.
export async function POST(request) {
  const admin = await isAdminAuthed();
  const scannerSession = admin ? null : await getScannerSession();
  const scannerEventId = scannerSession?.eventId || null;
  const staffName = admin ? "مسؤول المنصة" : scannerSession?.staffName || "غير معروف";

  if (!admin && !scannerEventId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { code } = await request.json().catch(() => ({}));
  const { valid, guestId } = verifyCheckinCode(code);

  const result = await withDb((db) => {
    db.checkinLogs = db.checkinLogs || [];

    function logAndReturn(entry) {
      db.checkinLogs.unshift({
        id: randomUUID(),
        eventId: entry.eventId ?? scannerEventId ?? null,
        guestId: entry.guestId ?? null,
        guestName: entry.guestName ?? null,
        staffName,
        ok: entry.ok,
        reason: entry.reason ?? null,
        message: entry.message,
        createdAt: new Date().toISOString(),
      });
      // Bounded so it doesn't grow forever.
      db.checkinLogs = db.checkinLogs.slice(0, 500);
      return entry;
    }

    if (!valid) {
      return logAndReturn({
        ok: false,
        reason: "invalid",
        message: "رمز غير صالح — ليس رمز QR الخاص بهذه الدعوة",
      });
    }

    const guest = db.guests.find((g) => g.id === guestId);
    if (!guest) {
      return logAndReturn({ ok: false, reason: "not_found", message: "الضيف غير موجود", guestId });
    }

    if (scannerEventId && guest.eventId !== scannerEventId) {
      return logAndReturn({
        ok: false,
        reason: "wrong_event",
        message: "رمز الدخول هذا يخصّ زفافًا آخر — وليس من ضيوف الزفاف الذي سجَّل هذا الماسح الدخول عليه",
        eventId: guest.eventId,
        guestId: guest.id,
        guestName: guest.name,
      });
    }

    if (guest.status === "declined") {
      return logAndReturn({
        ok: false,
        reason: "declined",
        message: `اعتذر ${guest.name} عن الحضور`,
        eventId: guest.eventId,
        guestId: guest.id,
        guestName: guest.name,
      });
    }

    if (guest.status !== "confirmed") {
      return logAndReturn({
        ok: false,
        reason: "not_confirmed",
        message: `لم يؤكد ${guest.name} الحضور بعد — لا يُفترض أن يكون لديه رمز QR أصلًا`,
        eventId: guest.eventId,
        guestId: guest.id,
        guestName: guest.name,
      });
    }

    // Total people this ONE guest is allowed to bring through this QR —
    // the guest themself plus however many companions they confirmed.
    const partySize = 1 + (guest.confirmedCompanions || 0);
    const checkedInCount = guest.checkedInCount || 0;

    if (checkedInCount >= partySize) {
      return logAndReturn({
        ok: false,
        reason: "already_full",
        message: `اكتمل العدد المسموح به لـ ${guest.name} بالكامل (${partySize} من ${partySize}) — هذا الرمز مستخدَم بالكامل من قبل`,
        eventId: guest.eventId,
        guestId: guest.id,
        guestName: guest.name,
      });
    }

    guest.checkedInCount = checkedInCount + 1;
    guest.checkedIn = guest.checkedInCount >= partySize; // true once the whole party is in
    if (!guest.checkedInAt) guest.checkedInAt = new Date().toISOString();
    guest.lastCheckedInAt = new Date().toISOString();

    const remaining = partySize - guest.checkedInCount;
    const message =
      remaining > 0
        ? `أهلًا — دخل أحد أفراد ضيوف ${guest.name} (${guest.checkedInCount} من ${partySize}) — المتبقّي ${remaining}`
        : `أهلًا ${guest.name} 🎉 (${guest.checkedInCount} من ${partySize}) — اكتمل العدد المسموح به`;

    return logAndReturn({
      ok: true,
      message,
      eventId: guest.eventId,
      guestId: guest.id,
      guestName: guest.name,
      partySize,
      checkedInCount: guest.checkedInCount,
      remaining,
    });
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
